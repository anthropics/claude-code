const path = require('path');
const bindings = require('node-gyp-build')(path.resolve(__dirname));

const crypto = require('crypto');

const promises = require('./promises');

/// generate a salt (sync)
/// @param {Number} [rounds] number of rounds (default 10)
/// @return {String} salt
function genSaltSync(rounds, minor) {
    // default 10 rounds
    if (!rounds) {
        rounds = 10;
    } else if (typeof rounds !== 'number') {
        throw new Error('rounds must be a number');
    }

    if (!minor) {
        minor = 'b';
    } else if (minor !== 'b' && minor !== 'a') {
        throw new Error('minor must be either "a" or "b"');
    }

    return bindings.gen_salt_sync(minor, rounds, crypto.randomBytes(16));
}

/// generate a salt
/// @param {Number} [rounds] number of rounds (default 10)
/// @param {Function} cb callback(err, salt)
function genSalt(rounds, minor, cb) {
    let error;

    // if callback is first argument, then use defaults for others
    if (typeof arguments[0] === 'function') {
        // have to set callback first otherwise arguments are overridden
        cb = arguments[0];
        rounds = 10;
        minor = 'b';
        // callback is second argument
    } else if (typeof arguments[1] === 'function') {
        // have to set callback first otherwise arguments are overridden
        cb = arguments[1];
        minor = 'b';
    }

    if (!cb) {
        return promises.promise(genSalt, this, [rounds, minor]);
    }

    // default 10 rounds
    if (!rounds) {
        rounds = 10;
    } else if (typeof rounds !== 'number') {
        // callback error asynchronously
        error = new Error('rounds must be a number');
        return process.nextTick(function () {
            cb(error);
        });
    }

    if (!minor) {
        minor = 'b'
    } else if (minor !== 'b' && minor !== 'a') {
        error = new Error('minor must be either "a" or "b"');
        return process.nextTick(function () {
            cb(error);
        });
    }

    crypto.randomBytes(16, function (error, randomBytes) {
        if (error) {
            cb(error);
            return;
        }

        bindings.gen_salt(minor, rounds, randomBytes, cb);
    });
}

/// hash data using a salt
/// @param {String|Buffer} data the data to encrypt
/// @param {String} salt the salt to use when hashing
/// @return {String} hash
function hashSync(data, salt) {
    if (data == null || salt == null) {
        throw new Error('data and salt arguments required');
    }

    if (!(typeof data === 'string' || data instanceof Buffer) || (typeof salt !== 'string' && typeof salt !== 'number')) {
        throw new Error('data must be a string or Buffer and salt must either be a salt string or a number of rounds');
    }

    if (typeof salt === 'number') {
        salt = module.exports.genSaltSync(salt);
    }

    return bindings.encrypt_sync(data, salt);
}

/// hash data using a salt
/// @param {String|Buffer} data the data to encrypt
/// @param {String} salt the salt to use when hashing
/// @param {Function} cb callback(err, hash)
function hash(data, salt, cb) {
    let error;

    if (typeof data === 'function') {
        error = new Error('data must be a string or Buffer and salt must either be a salt string or a number of rounds');
        return process.nextTick(function () {
            data(error);
        });
    }

    if (typeof salt === 'function') {
        error = new Error('data must be a string or Buffer and salt must either be a salt string or a number of rounds');
        return process.nextTick(function () {
            salt(error);
        });
    }

    // cb exists but is not a function
    // return a rejecting promise
    if (cb && typeof cb !== 'function') {
        return promises.reject(new Error('cb must be a function or null to return a Promise'));
    }

    if (!cb) {
        return promises.promise(hash, this, [data, salt]);
    }

    if (data == null || salt == null) {
        error = new Error('data and salt arguments required');
        return process.nextTick(function () {
            cb(error);
        });
    }

    if (!(typeof data === 'string' || data instanceof Buffer) || (typeof salt !== 'string' && typeof salt !== 'number')) {
        error = new Error('data must be a string or Buffer and salt must either be a salt string or a number of rounds');
        return process.nextTick(function () {
            cb(error);
        });
    }


    if (typeof salt === 'number') {
        return module.exports.genSalt(salt, function (err, salt) {
            return bindings.encrypt(data, salt, cb);
        });
    }

    return bindings.encrypt(data, salt, cb);
}

/// compare raw data to hash
/// @param {String|Buffer} data the data to hash and compare
/// @param {String} hash expected hash
/// @return {bool} true if hashed data matches hash
function compareSync(data, hash) {
    if (data == null || hash == null) {
        throw new Error('data and hash arguments required');
    }

    if (!(typeof data === 'string' || data instanceof Buffer) || typeof hash !== 'string') {
        throw new Error('data must be a string or Buffer and hash must be a string');
    }

    return bindings.compare_sync(data, hash);
}

/// compare raw data to hash
/// @param {String|Buffer} data the data to hash and compare
/// @param {String} hash expected hash
/// @param {Function} cb callback(err, matched) - matched is true if hashed data matches hash
function compare(data, hash, cb) {
    let error;

    if (typeof data === 'function') {
        error = new Error('data and hash arguments required');
        return process.nextTick(function () {
            data(error);
        });
    }

    if (typeof hash === 'function') {
        error = new Error('data and hash arguments required');
        return process.nextTick(function () {
            hash(error);
        });
    }

    // cb exists but is not a function
    // return a rejecting promise
    if (cb && typeof cb !== 'function') {
        return promises.reject(new Error('cb must be a function or null to return a Promise'));
    }

    if (!cb) {
        return promises.promise(compare, this, [data, hash]);
    }

    if (data == null || hash == null) {
        error = new Error('data and hash arguments required');
        return process.nextTick(function () {
            cb(error);
        });
    }

    if (!(typeof data === 'string' || data instanceof Buffer) || typeof hash !== 'string') {
        error = new Error('data and hash must be strings');
        return process.nextTick(function () {
            cb(error);
        });
    }

    return bindings.compare(data, hash, cb);
}

/// @param {String} hash extract rounds from this hash
/// @return {Number} the number of rounds used to encrypt a given hash
function getRounds(hash) {
    if (hash == null) {
        throw new Error('hash argument required');
    }

    if (typeof hash !== 'string') {
        throw new Error('hash must be a string');
    }

    return bindings.get_rounds(hash);
}

module.exports = {
    genSaltSync,
    genSalt,
    hashSync,
    hash,
    compareSync,
    compare,
    getRounds,
}
