use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

use crate::errors::Error;

pub fn hash(pin: String) -> Result<String, Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let pin_hash = argon2
        .hash_password(pin.as_bytes(), &salt)
        .map_err(|err| Error::Other(err.to_string()))?
        .to_string();
    Ok(pin_hash)
}

pub fn verify(pin: String, hash: String) -> Result<bool, Error> {
    let argon2 = Argon2::default();
    let parsed_hash = PasswordHash::new(&hash).map_err(|err| Error::Other(err.to_string()))?;
    let is_valid = argon2.verify_password(pin.as_bytes(), &parsed_hash).is_ok();
    Ok(is_valid)
}
