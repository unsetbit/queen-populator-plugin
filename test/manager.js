var sinon = require('sinon'),
	mocks = require('mocks'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	theModule;

theModule = mocks.loadFile(path.resolve(path.dirname(module.filename), '../lib/manager.js'));

function createMockQueen(){
	var mock = {};
	var eventEmitter = mock.emitter = new EventEmitter();
	mock.on = sinon.spy(eventEmitter.on.bind(eventEmitter));
	mock.removeListener = sinon.spy(eventEmitter.removeListener.bind(eventEmitter));
	
	return mock;
}

function createMockClient(){
	var mock = {};
	var eventEmitter = mock.emitter = new EventEmitter();
	mock.on = sinon.spy(eventEmitter.on.bind(eventEmitter));
	mock.removeListener = sinon.spy(eventEmitter.removeListener.bind(eventEmitter));
	mock.kill = sinon.spy();

	return mock;	
}

function createMockPopulator(){
	var client = createMockClient();
	var mock = sinon.stub().callsArgWith(1, client);
	var eventEmitter = mock.emitter = new EventEmitter();
	mock.on = eventEmitter.on.bind(eventEmitter);
	mock.removeListener = eventEmitter.removeListener.bind(eventEmitter);
	mock.kill = sinon.spy();
	mock.clientConfig = {};
	mock.client = client;
	mock.clients = [mock.clientConfig];

	return mock;	
}

var Manager = theModule.Manager,
	create = theModule.create;

exports.test = {
	setUp: function(callback){
		this.queen = createMockQueen();
		this.manager = new Manager(this.queen);
		callback();
	},
	
	construct: function(test){
		test.throws(function(){new Manager()}, "Missing required params throws errors");
		test.done();
	},

	create: function(test){
		test.throws(function(){create()}, "Missing required params throws errors");
		test.done();
	},

	workerProviderHandler: function(test){
		var provider = {
			on: sinon.spy(),
			attributes: {}
		};
		this.queen.emitter.emit("workerProvider", provider);

		test.ok(!provider.on.called, "Providers without clientIds are ignored");
		
		provider.attributes.populatorClientId = "1";

		this.queen.emitter.emit("workerProvider", provider);

		test.ok(!provider.on.called, "Providers with clientIds but no corresponding clients ignored");

		var client = createMockClient();
		this.manager.spawnedClients["1"] = client;

		this.queen.emitter.emit("workerProvider", provider);

		test.ok(provider.on.called, "Providers with clientIds but no corresponding clients ignored");

		test.done();
	},

	clientKilledWhenWorkerProviderDead: function(test){
		var emitter = new EventEmitter();
		var provider = {
			on: emitter.on.bind(emitter),
			attributes: {
				populatorClientId: "1"
			},
		};

		var client = createMockClient();
		this.manager.spawnedClients["1"] = client;

		this.queen.emitter.emit("workerProvider", provider);

		emitter.emit('dead');

		test.ok(client.kill.called, "Client killed when provider dead");

		var client = createMockClient();
		this.manager.spawnedClients["1"] = client;
		this.queen.emitter.emit("workerProvider", provider);

		emitter.emit('unresponsive');

		test.ok(client.kill.called, "Client killed when provider unresponsive");

		test.done();
	},
	
	attach: function(test){
		var populator = createMockPopulator();
		var self = this;
		this.manager.attach(populator);
		test.equal(this.manager.populators.length, 1, "Populator added");

		test.throws(function(){self.attach({})}, "Invalid populator throws error");
		
		test.done();
	},

	detach: function(test){
		var populator = createMockPopulator();
		var self = this;
		this.manager.attach(populator);
		test.equal(this.manager.populators.length, 1, "Populator added");

		this.manager.dettach({});
		test.equal(this.manager.populators.length, 1, "Invalid populators don't change a thing");
		
		this.manager.dettach(populator);
		test.equal(this.manager.populators.length, 0, "Populator removed");

		test.done();
	},

	autoSpawnClients: function(test){
		var populator = createMockPopulator();
		var self = this;

		this.manager.attach(populator);
		test.equal(this.manager.populators.length, 1, "Populator added");

		test.ok(populator.calledWith(populator.clientConfig), "Populator called with unspawned client");
		test.ok(populator.client.on.called, "Populator client called");
		test.done();
	},

	clientDeath: function(test){
		var populator = createMockPopulator();
		this.manager.attach(populator);

		test.equal(Object.keys(this.manager.spawnedClients).length, 1, "Populator attached client");

		var spy = this.manager.retryPopulation = sinon.spy();
		populator.client.emitter.emit('dead');
		test.equal(Object.keys(this.manager.spawnedClients).length, 0, "Populator dettached dead client");

		test.ok(spy.called, "Repopulation attempted");
		test.done();
	}
};