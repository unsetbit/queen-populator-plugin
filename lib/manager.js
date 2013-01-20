"use strict";

var its = require('its'),
	generateId = require('node-uuid').v4;

var create = module.exports = function(queen){
	var manager = new Manager(queen);

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

	this.queen.on('workerProvider', this.workerProviderHandler.bind(this));
}

Manager.prototype.workerProviderHandler = function(workerProvider){
	var self = this,
		clientId = workerProvider && workerProvider.attributes && workerProvider.attributes.populatorClientId;

	// Were only interested in worker providers we spawn
	if(!(clientId && clientId in self.spawnedClients)) return;

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

			clientConfig.url = self.captureUrl + "clientId=" + clientId;
			populator(clientConfig, function(client){
				// If populator was unable to spawn the client, 
				// add it back to the queue
				if(!client){
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
			});
		});

		populator.clients = remaining;
	});
};

Manager.prototype.populatorRetryTimeout = 5 * 1000; // 5 seconds

Manager.prototype.retryPopulation = function(){
	var self = this;
	if(this.repopulateTimeout) return;
	
	this.repopulateTimeout = setTimeout(function(){
		clearTimeout(self.repopulateTimeout);
		self.repopulateTimeout = void 0;
		self.autoSpawnClients();
	}, this.populatorRetryTimeout);	
};