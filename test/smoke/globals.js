'use strict';

/* jshint browser:true */
/* globals expect:false */

describe('Custom UMD Build', function () {

  var OriginalWilddog, OriginalWilddogSimpleLogin;
  beforeEach(function () {
    window.Wilddog = OriginalWilddog = {};
  });

  it('exposes the full module as "mockwilddog"', function () {
    expect(window).to.have.property('mockwilddog').that.is.an('object');
  });

  it('exposes "MockWilddog" on the window', function () {
    expect(window)
      .to.have.property('MockWilddog')
      .that.equals(window.mockwilddog.MockWilddog);
  });


  describe('#restore', function () {

    it('is a noop before #override is called', function () {
      window.MockWilddog.restore();
      expect(window)
        .to.have.property('Wilddog')
        .that.equals(OriginalWilddog);
    });

    it('can restore Wilddog', function () {
      window.MockWilddog.override();
      window.MockWilddog.restore();
      expect(window)
        .to.have.property('Wilddog')
        .that.equals(OriginalWilddog);
    });

  });

  describe('#override', function () {

    it('can override Wilddog', function () {
      window.MockWilddog.override();
      expect(window)
        .to.have.property('Wilddog')
        .that.equals(window.mockwilddog.MockWilddog);
    });

  });

});
