#!/bin/bash
cd client
npm install
npm run build
echo "Build complete, dist contents:"
ls -la dist/