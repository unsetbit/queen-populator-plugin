var sinon = require('sinon'),
	mocks = require('mocks'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	theModule;

var mockWd = createMockWd();

theModule = mocks.loadFile(path.resolve(path.dirname(module.filename), '../lib/sauce.js'),{
	'wd': mockWd
});

function createMockWdClient(){
	var mock = {};
	mock.init = sinon.stub().callsArg(1);
	mock.get = sinon.spy();
	mock.quit = sinon.stub().callsArg(0);
	return mock;
}

function createMockWd(){
	var mock = {};
	mock.reset = function(){
		mock.client = createMockWdClient();
		mock.remote = sinon.stub().returns(mock.client);
	}

	mock.reset();

	return mock;
}

var Populator = theModule.SaucePopulator,
	create = theModule.create,
	createClient = theModule.createSauceClient;

exports.test = {
	setUp: function(callback){
		this.populator = new Populator("starfleet.com", 80, "bill", "clinton");
		callback();
	},
	
	construct: function(test){
		test.throws(function(){new Populator({})}, "Missing required params throws errors");
		test.done();
	},

	create: function(test){
		test.throws(function(){create({})}, "Missing required params throws errors");
		test.done();
	},

	createClient: function(test){
		var config = {
			os: "Pooper",
			browser: "Scooper",
			version: "1",
			url: ""
		};
		test.throws(function(){createClient({}, function(){})}, "Missing required params throws error");

		test.throws(function(){createClient(config, {})}, "Missing required params throws error");

		var spy = sinon.spy();
		createClient(config, spy);
		test.ok(!(spy.lastCall.args[0] instanceof Error), "Created client");

		createClient(config, function(worker){
			var killDoneSpy = sinon.spy();
			worker.kill(killDoneSpy);
			test.equal(killDoneSpy.callCount, 1, "Worker death callback fires");
		});

		test.done();
	},

	spawn: function(test){
		var self = this;
		test.throws(function(){self.populator.spawn();}, "Missing required params throws errors");
		
		var config = {
			os: "Big",
			browser: "Bird",
			version: "1",
			url: ""
		};

		var spy = sinon.spy();
		self.populator.spawn(config, spy);

		test.equal(spy.callCount, 1, "Spawn callback fires");

		test.done();
	},

	kill: function(test){
		var self = this;

		var config = {
			os: "Big",
			browser: "Bird",
			version: "1",
			url: ""
		};

		var client;
		self.populator.spawn(config, function(theClient){client = theClient});
		
		test.equal(self.populator.clients.length, 1, "Spawned client is tracked");	
		client.kill();
		test.equal(self.populator.clients.length, 0, "Killed client is removed");

		test.done();
	}
};