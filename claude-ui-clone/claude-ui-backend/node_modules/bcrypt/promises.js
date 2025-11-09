let Promise = global.Promise;

/// encapsulate a method with a node-style callback in a Promise
/// @param {object} 'this' of the encapsulated function
/// @param {function} function to be encapsulated
/// @param {Array-like} args to be passed to the called function
/// @return {Promise} a Promise encapsulating the function
function promise(fn, context, args) {
    if (!Array.isArray(args)) {
        args = Array.prototype.slice.call(args);
    }

    if (typeof fn !== 'function') {
        return Promise.reject(new Error('fn must be a function'));
    }

    return new Promise((resolve, reject) => {
        args.push((err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });

        fn.apply(context, args);
    });
}

/// @param {err} the error to be thrown
function reject(err) {
    return Promise.reject(err);
}

/// changes the promise implementation that bcrypt uses
/// @param {Promise} the implementation to use
function use(promise) {
    Promise = promise;
}

module.exports = {
    promise,
    reject,
    use
}
