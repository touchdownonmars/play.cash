#!/bin/sh
# Update code and restart server (run from app server)
set -e

if [ -d "/home/feross/www/play.cash-build" ]; then
  echo "ERROR: Build folder already exists. Is another build in progress?"
  exit 1
fi

cp -R /home/feross/www/play.cash /home/feross/www/play.cash-build

cd /home/feross/www/play.cash-build && git pull
cd /home/feross/www/play.cash-build && rm -rf node_modules
cd /home/feross/www/play.cash-build && npm install --production --quiet
cd /home/feross/www/play.cash-build && npm run build

sudo supervisorctl stop play

cd /home/feross/www && mv play.cash play.cash-old
cd /home/feross/www && mv play.cash-build play.cash

sudo supervisorctl start play

cd /home/feross/www && rm -rf play.cash-old
