module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    files: {
      src: ['lib/**/*.js'],
      test: {
        src: ['test/**/*.js']
      }
    },
    lint: {
      all: '<config:files.src>',
    },
    test: {
      lib: '<config:files.test.src>'
    },
    jshint: {
      all: {
        options: {
          node: true
        }
      },
      options: {
        quotmark: 'single',
        camelcase: true,
        trailing: true,
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true
      },
      globals: {}
    }
  });

  grunt.registerTask('default', 'lint test')
};