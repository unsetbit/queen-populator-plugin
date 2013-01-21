"use strict";

var its = require('its'),
	utils = require('./utils.js'),
	generateId = require('node-uuid').v4;

var create = module.exports = function(queen, config, options){
	var manager = new Manager(queen);

	options = options || {};
	if(options.log) manager.log = options.log;
	if(options.debug) manager.debug = options.debug;

	var populators = config && config.populator;
	if(populators){
		if(!(populators instanceof Array)) populators = [populators];

		populators.forEach(function(populatorConfig){
			var populator,
				populatorType = populatorConfig.type,
				populatorOptions = populatorConfig.config;

			populatorOptions.log = manager.log;
			populatorOptions.debug = manager.debug;

			switch(populatorType){
				case "selenium":
					populator = require('./selenium.js')(populatorOptions);
					break;
				case "sauce":
					populator = require('./sauce.js')(populatorOptions.username, populatorOptions.accessKey, populatorOptions);
					break;
				case "browserstack":
					populator = require('./browserstack')(populatorOptions.username, populatorOptions.password, populatorOptions);
					break;
				default:
					return;
			}

			populator.clients = populatorConfig.clients || [];
			manager.attach(populator);
		});
	}

	return getApi(manager);
};

function getApi(manager){
	var api = manager.attach.bind(manager);
	api.attach = api;
	api.detach = manager.dettach.bind(manager);
	return api;
}

function Manager(queen){
	its.object(queen);

	this.queen = queen;
	this.captureUrl = queen.captureUrl + ((~queen.captureUrl.indexOf('?'))? "&" : "?");
	this.populators = [];
	this.spawnedClients = {};
	this.pendingClients = {};

	this.queen.on('workerProvider', this.workerProviderHandler.bind(this));
	
	this.queen.on('dead', this.kill.bind(this));
}

Manager.prototype.log = utils.noop;
Manager.prototype.debug = utils.noop;
Manager.prototype.kill = function(callback){
	var waitingCount = Object.keys(this.spawnedClients).length;
	utils.each(this.spawnedClients, function(client){
		client.kill(function(){
			waitingCount--
			if(waitingCount === 0){
				callback && callback();
			}
		});
	});	
};

// How often we try to repopulate disconnected or unresponsive browsers
Manager.prototype.populatorRetryTimeout = 5 * 1000; // 5 seconds

// How much time a browser has to connect to queen before we retry
Manager.prototype.connectionTimeout = 60 * 1000; // 1 minute

Manager.prototype.workerProviderHandler = function(workerProvider){
	var self = this,
		clientId = workerProvider && workerProvider.attributes && workerProvider.attributes.populatorClientId;

	// Were only interested in worker providers we spawn
	if(!(clientId && clientId in self.spawnedClients)) return;
	
	if(clientId in this.pendingClients){
		// Clears the response timeout
		clearTimeout(this.pendingClients[clientId]);
	}

	workerProvider.on('dead', function(){
		if(clientId in self.spawnedClients){
			var client = self.spawnedClients[clientId];
			client.kill();
		}
	});

	workerProvider.on('unresponsive', function(){
		if(clientId in self.spawnedClients){
			var client = self.spawnedClients[clientId];
			client.kill();
		}
	});
};

Manager.prototype.attach = function(populator){
	its.func(populator);
	this.log('[Queen Populator] Attaching populator: ' + populator + "\n");
	this.populators.push(populator);
	this.autoSpawnClients();
};

Manager.prototype.dettach = function(populator){
	var index = this.populators.indexOf(populator);
	
	if(!~index) return;
	
	this.populators.splice(index, 1);
};


Manager.prototype.autoSpawnClients = function(){
	var self = this,
		queen = this.queen;

	this.populators.forEach(function(populator){
		var remaining = [];

		populator.clients.forEach(function(clientConfig){
			var clientId = generateId();
			self.debug("[Queen Populator] Starting client using populator: " + populator + "\n");
			clientConfig.url = self.captureUrl + "clientId=" + clientId;
			
			populator(clientConfig, function(client){
				// If populator was unable to spawn the client, 
				// add it back to the queue
				if(client instanceof Error){
					self.debug("[Queen Populator] Error when trying to start client using populator (" + populator + "): " + client + "\n");
					remaining.push(clientConfig);
					self.retryPopulation();
					return;
				}
				
				self.spawnedClients[clientId] = client;
				client.on('dead', function(){
					delete self.spawnedClients[clientId];
					populator.clients.push(clientConfig);
					self.retryPopulation();
				});

				if(self.connectionTimeout){
					self.pendingClients[clientId] = setTimeout(function(){
						self.log("[Queen Populator] Client did not respond in time, killing it. Populator: " + populator + "\n");
						client.kill();
					}, self.connectionTimeout);
				}
			});
		});

		populator.clients = remaining;
	});
};


Manager.prototype.retryPopulation = function(){
	var self = this;
	if(this.repopulateTimeout) return;
	
	this.repopulateTimeout = setTimeout(function(){
		clearTimeout(self.repopulateTimeout);
		self.repopulateTimeout = void 0;
		self.autoSpawnClients();
	}, this.populatorRetryTimeout);	
};