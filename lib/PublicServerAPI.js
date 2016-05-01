'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createServer = createServer;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _server = require('react-dom/server');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _reactRouter = require('react-router');

var _reactTitleComponent = require('react-title-component');

var _compression = require('compression');

var _compression2 = _interopRequireDefault(_compression);

var _hpp = require('hpp');

var _hpp2 = _interopRequireDefault(_hpp);

var _helmet = require('helmet');

var _helmet2 = _interopRequireDefault(_helmet);

var _LogUtils = require('./LogUtils');

var _Constants = require('./Constants');

var _ErrorMessage = require('./ErrorMessage');

var _ErrorMessage2 = _interopRequireDefault(_ErrorMessage);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createServer(getApp) {
  var server = (0, _express2.default)();
  var webpackStats = getWebpackStats();
  server.disable('x-powered-by');
  server._listen = server.listen;
  server.listen = function () {
    throw new Error('[react-project]', 'Do not call `server.listen()`, use `server.start()`');
  };

  server.start = function () {
    addMiddleware(server);
    server.all('*', function (req, res) {
      getApp(req, res, function (err, _ref) {
        var render = _ref.render;
        var routes = _ref.routes;

        if (err) {
          onError(err, req, res);
        } else {
          (0, _reactRouter.match)({ routes: routes, location: req.url }, function (err, redirect, routerProps) {
            if (err) {
              onError(err, req, res);
            } else if (redirect) {
              // TODO: need a way to specify 301, 302, 307 etc. in the route config.
              // will need to make changes in React Router or history probably
              res.redirect(redirect.pathname + redirect.search);
            } else if (routerProps) {
              sendWithReactRouter({ req: req, res: res, render: render, webpackStats: webpackStats, routerProps: routerProps });
            } else {
              sendNoRoutesMatched(res);
            }
          });
        }
      });
    });

    server._listen(_Constants.PORT, function () {
      (0, _LogUtils.log)();
      (0, _LogUtils.log)('NODE_ENV=' + process.env.NODE_ENV);
      (0, _LogUtils.log)('Express server listening on port', _Constants.PORT);
    });
  };

  return server;
} // You have to be careful about which files this thing brings in because
// it gets bundled into a single file and then required, so process.pwd()
// and friends are going to be different, not sure how to keep it sane
// yet. Only problem I've run into is trying to read the app's package.json
// in a module this imports, like Constants, but then it doesn't work when
// the bundled server runs. So ... don't try to read the app's package.json,
// and ... be careful.
//
// Also note that any dependencies in here need to in the `peerDependencies`
// entry in package.json. We don't package up any node_modules into the
// server build for two reasons 1) that file would be ginourmous and take
// a long time to bundle and 2) it's pretty cool that the app gets to
// decide which version of express, or react it wants to use, so that
// our release cycle doesn't get in the way of theirs.


function addMiddleware(server) {
  if (process.env.NODE_ENV === 'production') {
    // server.use(morgan('combined'))
    server.use((0, _compression2.default)());
    server.use(_express2.default.static(_Constants.PUBLIC_DIR, { maxAge: 31536000000 }));
  }
  // } else {
  //   server.use(morgan('dev'))
  // }

  server.use(_express2.default.static(_path2.default.join(_Constants.APP_PATH, 'static')));
  server.use(_bodyParser2.default.json());
  server.use((0, _hpp2.default)());
  server.use(_helmet2.default.contentSecurityPolicy({
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'"],
    connectSrc: ["'self'", 'ws:'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'none'"],
    frameSrc: ["'none'"]
  }));
  server.use(_helmet2.default.xssFilter());
  server.use(_helmet2.default.frameguard('deny'));
  server.use(_helmet2.default.ieNoOpen());
  server.use(_helmet2.default.noSniff());
}

function sendWithReactRouter(_ref2) {
  var req = _ref2.req;
  var res = _ref2.res;
  var render = _ref2.render;
  var webpackStats = _ref2.webpackStats;
  var routerProps = _ref2.routerProps;
  var routes = routerProps.routes;

  var lastRoute = routes[routes.length - 1];
  if (lastRoute.isServerRoute) {
    handleServerRoute(req, res, lastRoute, {
      params: routerProps.params,
      location: routerProps.location,
      routes: routerProps.routes,
      route: lastRoute
    });
  } else if (req.method !== 'GET') {
    sendNoRoutesMatched(res);
  } else {
    render(routerProps, function (err, _ref3) {
      var renderDocument = _ref3.renderDocument;
      var renderApp = _ref3.renderApp;

      if (err) {
        onError(err, req, res);
      } else {
        var status = err ? err.status : lastRoute.status || 200;
        var appElement = renderApp(routerProps);
        var content = getContent(req, appElement);
        var documentElement = renderDocument({
          title: (0, _reactTitleComponent.flushTitle)(),
          content: content,
          scripts: getJavaScriptTags(webpackStats),
          styles: getStyleTags(webpackStats)
        });
        var markup = (0, _server.renderToStaticMarkup)(documentElement);
        res.status(status).send('<!doctype html>\n' + markup);
      }
    });
  }
}

function handleServerRoute(req, res, route, props) {
  var handler = route[req.method.toLowerCase()];
  if (!handler) {
    res.status(500).send((0, _server.renderToStaticMarkup)(_react2.default.createElement(
      _ErrorMessage2.default,
      null,
      _react2.default.createElement(
        'p',
        null,
        'Route has no handler. Add "get", "post" etc.'
      ),
      _react2.default.createElement(
        'pre',
        null,
        '<Route get={handler}/>'
      ),
      _react2.default.createElement(
        'p',
        null,
        'Route Props:'
      ),
      _react2.default.createElement(
        'pre',
        null,
        Object.keys(route).join(' ')
      )
    )));
  } else {
    handler(req, res, route, props);
  }
}

function onError(err, req, res) {
  res.status(500).send((0, _server.renderToStaticMarkup)(_react2.default.createElement(
    _ErrorMessage2.default,
    null,
    _react2.default.createElement(
      'p',
      null,
      'Unknown error occured:'
    ),
    _react2.default.createElement(
      'pre',
      null,
      err.message
    )
  )));
}

function getWebpackStats() {
  var file = _path2.default.resolve(_Constants.APP_PATH, '.build', 'stats.json');
  return JSON.parse(_fs2.default.readFileSync(file, 'utf8'));
}

function getContent(req, appElement) {
  return _Constants.SERVER_RENDERING ? (0, _server.renderToString)(appElement) : '';
}

function getAssetPaths(stats, regex) {
  return Object.keys(stats.assetsByChunkName).reduce(function (assets, key) {
    var chunk = stats.assetsByChunkName[key];
    var chunkArray = Array.isArray(chunk) ? chunk : [chunk];
    return assets.concat(chunkArray.filter(function (asset) {
      return regex.test(asset);
    }).map(function (asset) {
      return stats.publicPath + asset;
    }));
  }, []);
}

function getStyleTags(stats) {
  return getAssetPaths(stats, /\.css$/).map(function (href) {
    return _react2.default.createElement('link', { key: href, rel: 'stylesheet', href: href });
  });
}

function getJavaScriptTags(stats) {
  return getAssetPaths(stats, /\.js$/).map(function (src) {
    return _react2.default.createElement('script', { key: src, src: src });
  });
}

function sendNoRoutesMatched(res) {
  res.status(404).send((0, _server.renderToStaticMarkup)(_react2.default.createElement(
    _ErrorMessage2.default,
    null,
    _react2.default.createElement(
      'p',
      null,
      'No routes matched, you should add'
    ),
    _react2.default.createElement(
      'pre',
      null,
      '<Route path="*" component={NoMatch}/>'
    ),
    _react2.default.createElement(
      'p',
      null,
      'to the end of your route config so your visitors don\'t see this message ',
      ':)'
    )
  )));
}