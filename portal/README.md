DailyPay
--------

#create and run the web container for development
docker run -it \
    --name dailypay-dev \
    --env="NODE_ENV=development" \
    -p 3000:3000 \
    -p 5858:5858 \
    -v /Users/xxx/Documents/projects/js/dailypay/portal:/usr/src/app/ \
    --entrypoint /bin/bash \
    node:argon

#enter the container
docker exec -it dailypay-dev /bin/bash

#run app in docker container and listen to the debug port (with stop at first line)
node --debug=5858 app.js

#run app in docker container and listen to the debug port (with stop at first line)
node --debug-brk=5858 app.js


#resolve sass vendor binding file missing
#update npm to version 3.x, then run node install.js

root@63bb398dd8fe:/usr/src/app/node_modules/node-sass-middleware/node_modules/node-sass# node scripts/install.js
