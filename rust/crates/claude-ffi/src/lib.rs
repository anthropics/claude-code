//! FFI bridge for TypeScript interop

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};

/// FFI handle
pub struct EngineHandle {
    /// Engine instance
    _engine: String,
}

/// Create engine instance
#[no_mangle]
pub extern "C" fn engine_create(api_key: *const c_char) -> *mut EngineHandle {
    if api_key.is_null() {
        return std::ptr::null_mut();
    }
    
    let _api_key = unsafe {
        match CStr::from_ptr(api_key).to_str() {
            Ok(s) => s.to_string(),
            Err(_) => return std::ptr::null_mut(),
        }
    };
    
    let handle = Box::new(EngineHandle {
        _engine: "engine".to_string(),
    });
    
    Box::into_raw(handle)
}

/// Destroy engine instance
#[no_mangle]
pub extern "C" fn engine_destroy(handle: *mut EngineHandle) {
    if !handle.is_null() {
        unsafe {
            let _ = Box::from_raw(handle);
        }
    }
}

/// Process a message
#[no_mangle]
pub extern "C" fn engine_process(
    handle: *mut EngineHandle,
    message: *const c_char,
    result: *mut c_char,
    result_len: c_int,
) -> c_int {
    if handle.is_null() || message.is_null() || result.is_null() {
        return -1;
    }
    
    let _msg = unsafe {
        match CStr::from_ptr(message).to_str() {
            Ok(s) => s.to_string(),
            Err(_) => return -1,
        }
    };
    
    let response = "Response from Rust engine";
    
    if response.len() >= result_len as usize {
        return -1;
    }
    
    unsafe {
        let c_response = match CString::new(response) {
            Ok(s) => s,
            Err(_) => return -1,
        };
        
        std::ptr::copy_nonoverlapping(
            c_response.as_ptr() as *const u8,
            result as *mut u8,
            response.len() + 1,
        );
    }
    
    0
}

/// Get version string
#[no_mangle]
pub extern "C" fn engine_version() -> *const c_char {
    static VERSION: &[u8] = b"0.1.0\0";
    VERSION.as_ptr() as *const c_char
}

