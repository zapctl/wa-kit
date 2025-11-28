#!/bin/bash

cd $DIST_DIR/nodejs

npm i
npm publish --provenance --access public --tag preview
