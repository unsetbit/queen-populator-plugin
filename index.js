var manager = module.exports = require('./lib/manager.js');
manager.createSelenium = require('./lib/selenium.js');
manager.createBrowserstack = require('./lib/browserstack.js');
manager.createSauce = require('./lib/sauce.js');