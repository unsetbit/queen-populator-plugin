"use strict";

var wd = require('wd'),
	EventEmitter = require('events').EventEmitter,
	utils = require('./utils.js'),
	its = require('its');

var create = module.exports = function(options){
	options = options || {};

	var host = options.host || "",
		hostArr = host.split(":"),
		hostname = hostArr[0] || "localhost",
		port = parseInt(hostArr[1]) || 4444,
		populator = new SeleniumPopulator(hostname, port);

	if(options.log) populator.log = options.log;
	if(options.debug) populator.debug = options.debug;

	return getApi(populator);
};

function getApi(populator){
	var api = populator.spawn.bind(populator);

	api.kill = populator.kill.bind(populator);
	api.toString = populator.toString.bind(populator);
	
	return api;
}

var createSeleniumClient = function(settings, callback){
	var client = wd.remote(settings),
		emitter = new EventEmitter(),
		api = {};
	
	its.object(settings, "settings object required");
	its.string(settings.url, "url in settings required");
	its.func(callback, "callback required");

	api.on = emitter.on.bind(emitter);
	api.removeListener = emitter.removeListener.bind(emitter);
	api.kill = function(callback){
		client.quit(callback || utils.noop);
		emitter.emit('dead');
	};
	api.settings = settings;

	client.init(settings, function(err){
		client.get(settings.url);
		
		if(err){
			console.log("Selenium Populator Error: " + err);
			api.kill();
			callback();
		} else {
			callback(api);
		}
	});

	return api;
};

function SeleniumPopulator(host, port){
	its.string(host, "host required");
	its.number(port, "port required");
	
	this.host = host;
	this.port = port;
	this.clients = [];
}

SeleniumPopulator.prototype.log = utils.noop;
SeleniumPopulator.prototype.debug = utils.noop;

SeleniumPopulator.prototype.spawn = function(settings, callback){
	var self = this,
		client;

	its.object(settings, "settings required");
	its.func(callback, "Callback required");
	
	settings.host = this.host;
	settings.port = this.port;
	
	client = createSeleniumClient(settings, callback);
	this.clients.push(client);
	client.on('dead', function(){
		var index = self.clients.indexOf(client);
		if(!~index) return;
		self.clients.splice(index,1);
	});
};

SeleniumPopulator.prototype.kill = function(){
	this.clients.forEach(function(client){
		client.kill();
	});
};

SeleniumPopulator.prototype.toString = function(){
	return "Selenium Populator";
};