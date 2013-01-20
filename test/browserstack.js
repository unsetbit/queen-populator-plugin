var sinon = require('sinon'),
	mocks = require('mocks'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	theModule;

var mockBrowserStack = createMockBrowserStack();

theModule = mocks.loadFile(path.resolve(path.dirname(module.filename), '../lib/browserstack.js'),{
	'browserstack': mockBrowserStack
});

function createMockBrowserStackClient(){
	var mock = {};
	mock.worker = {id: "1"};
	mock.createWorker = sinon.stub().callsArgWith(1, void 0, mock.worker);
	mock.terminateWorker = sinon.stub().callsArg(1);

	return mock;
}

function createMockBrowserStack(){
	var mock = {};
	mock.reset = function(){
		mock.client = createMockBrowserStackClient();
		mock.createClient = sinon.stub().returns(mock.client); 
	}

	mock.reset();

	return mock;
}

var Populator = theModule.BrowserStackPopulator,
	create = theModule.create,
	createClient = theModule.createClient;

exports.test = {
	setUp: function(callback){
		this.populator = new Populator("user", "pass");
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
		var mockBrowserStackClient = createMockBrowserStackClient();

		var config = {
			os: "Pooper",
			browser: "Scooper",
			version: "1"
		};
		test.throws(function(){createClient(mockBrowserStackClient, {}, function(){})}, "Missing required params throws error");

		test.throws(function(){createClient(mockBrowserStackClient, config, {})}, "Missing required params throws error");

		var spy = sinon.spy();
		createClient(mockBrowserStackClient, config, spy);
		test.ok(!(spy.lastCall.args[0] instanceof Error), "Created client");

		createClient(mockBrowserStackClient, config, function(worker){
			var killDoneSpy = sinon.spy();
			worker.kill(killDoneSpy);
			test.equal(mockBrowserStackClient.terminateWorker.callCount, 1, "Worker death terminates real worker");
			test.equal(killDoneSpy.callCount, 1, "Worker death callback fires");
		});

		test.done();
	},

	spawn: function(test){
		mockBrowserStack.reset();
		
		var self = this;
		test.throws(function(){self.populator.spawn();}, "Missing required params throws errors");
		
		var config = {
			os: "Big",
			browser: "Bird",
			version: "1"
		};

		var spy = sinon.spy();
		self.populator.spawn(config, spy);

		test.equal(spy.callCount, 1, "Spawn callback fires");

		test.done();
	},

	kill: function(test){
		mockBrowserStack.reset();
		
		var self = this;

		var config = {
			os: "Big",
			browser: "Bird",
			version: "1"
		};

		var client;
		self.populator.spawn(config, function(theClient){client = theClient});

		test.equal(self.populator.clients.length, 1, "Spawned client is tracked");	
		client.kill();
		test.equal(self.populator.clients.length, 0, "Killed client is removed");

		test.done();
	}
};