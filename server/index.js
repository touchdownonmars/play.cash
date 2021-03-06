require('./rollbar')

const ConnectSQLite = require('connect-sqlite3')
const downgrade = require('downgrade')
const http = require('http')
const path = require('path')
const session = require('express-session')
const unlimited = require('unlimited')

const app = require('./app')
const config = require('../config')

const PORT = process.argv[2] || 4000

unlimited() // Upgrade the max file descriptor limit

const server = http.createServer()
server.listen(PORT, onListening)

function onListening (err) {
  if (err) throw err
  console.log('Listening on port %s', server.address().port)

  downgrade() // Set the process user identity to 'www-data'

  // Open DB as 'www-data' user
  const SQLiteStore = ConnectSQLite(session)
  const sessionStore = new SQLiteStore({ dir: path.join(config.root, 'db') })

  app.init(server, sessionStore)
}
