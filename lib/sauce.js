"use strict";

var wd = require('wd'),
	EventEmitter = require('events').EventEmitter,
	utils = require('./utils.js'),
	its = require('its');

var create = module.exports = function(username, accessKey, options){
	options = options || {};
	var host = options.host || "",
		hostArr = host.split(":"),
		hostname = hostArr[0] || "ondemand.saucelabs.com",
		port = hostArr[1] || 80,
		populator = new SaucePopulator(hostname, port, username, accessKey);

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

function createSauceClient(settings, callback){
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
		if(err){
			api.kill();
			callback(new Error(err.message));
		} else {
			client.get(settings.url);
			callback(api);
		}
	});

	return api;
}

function SaucePopulator(host, port, username, accessKey ){
	its.string(host, "host required");
	its.number(port, "port required");
	its.string(username, "username required");
	its.string(accessKey, "accessKey required");

	this.host = host;
	this.port = port;
	this.username = username;
	this.accessKey  = accessKey;

	this.clients = [];
}

SaucePopulator.prototype.log = utils.noop;
SaucePopulator.prototype.debug = utils.noop;

SaucePopulator.prototype.spawn = function(settings, callback){
	var self = this,
		client;

	its.object(settings, "settings required");
	its.func(callback, "Callback required");
	
	settings.host = this.host;
	settings.port = this.port;
	settings.username = this.username;
	settings.accessKey = this.accessKey;
	client = createSauceClient(settings, callback);
	
	this.clients.push(client);

	client.on('dead', function(){
		var index = self.clients.indexOf(client);
		if(!~index) return;
		self.clients.splice(index,1);
	});
};

SaucePopulator.prototype.kill = function(){
	this.clients.forEach(function(client){
		client.kill();
	});
};

SaucePopulator.prototype.toString = function(){
	return "Sauce Populator";
};