"use strict";

var browserstack = require('browserstack'),
	EventEmitter = require('events').EventEmitter,
	utils = require('./utils.js'),
	its = require('its');

var create = module.exports = function(username, password, options){
	options = options || {};
	
	var populator = new BrowserStackPopulator(username, password, options.version, options.server);

	if(options.log) populator.log = options.log;
	if(options.debug) populator.debug = options.debug;

	return getApi(populator);
};

function getApi(populator){
	var api = populator.spawn.bind(populator);
	api.kill = populator.kill.bind(populator);

	return api;
}

function createClient(browserstack, settings, callback){
	var worker,
		emitter = new EventEmitter(),
		api = {};

	its.object(settings, "settings object is required");
	its.string(settings.os, "os is required");
	its.string(settings.browser || settings.device, "browser or device required");
	its.string(settings.version, "string version required");
	its.func(callback, "callback required");

	api.on = emitter.on.bind(emitter);
	api.removeListener = emitter.removeListener.bind(emitter);
	api.kill = function(callback){
		emitter.emit('dead');
		if(callback) callback();
	};

	api.settings = settings;

	browserstack.createWorker(settings, function(err, worker){
		if(err){
			api.kill();
			callback(err);
		} else {
			api.kill = function(callback){
				browserstack.terminateWorker(worker.id, callback || utils.noop);
				emitter.emit('dead');
			};

			callback(api);
		}
	});

	return api;
}

function BrowserStackPopulator(username, password, version, server){
	its.string(username, "Username is required");
	its.string(password, "Password is required");

	var config = {
		username: username,
		password: password
	};

	if(version) config.version = version;
	if(server) config.server = server;

	this.browserstack = browserstack.createClient(config);
	this.clients = [];
}

BrowserStackPopulator.prototype.log = utils.noop;
BrowserStackPopulator.prototype.debug = utils.noop;

BrowserStackPopulator.prototype.spawn = function(settings, callback){
	var self = this,
		client;

	its.object(settings, "settings required");
	its.func(callback, "Callback required");
	
	client = createClient(this.browserstack, settings, callback);
	this.clients.push(client);
	client.on('dead', function(){
		var index = self.clients.indexOf(client);
		if(!~index) return;
		self.clients.splice(index,1);
	});
};

BrowserStackPopulator.prototype.kill = function(){
	this.clients.forEach(function(client){
		client.kill();
	});
};