/**
 * List of routes in the app. Specified as [routeName, routePath, isEntity]. The third
 * argument is a boolean describing whether the route is an "entity" with a permalink.
 */

const routes = [
  ['home', '/'],
  ['artist', '/:name', true],
  ['track', '/:artist/:name', true],
  ['album', '/:artist/album/:name', true]
]

module.exports = routes
