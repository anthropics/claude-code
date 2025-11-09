const bcrypt = require('../bcrypt');

(function printSalt() {
  bcrypt.genSalt(10, (err, salt) => {
    console.log('salt: ' + salt);
    printSalt();
  });
})()
