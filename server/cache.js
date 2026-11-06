import { logger } from "./logger.js";

const TTL_SECONDS = 10 * 60; // safety net: cached results expire after 10 minutes (Time to Live = TTL)

// The Redis client. null = caching is off (tests, or no REDIS_URL set).
let redis = null;

// Lets index.js plug in the real Redis, and tests plug in the fake one.
export function setRedisClient(client) {
  redis = client;
}

// All of one user's cached analytics live in one Redis hash.
const keyFor = (userId) => `analytics:${userId}`;

//Returns the cached value for this user + field, or null if not cached. 
export async function getCached(userId, field) {

  // if caching is off, return null
  if(!redis)return null;
  
   
  try {
    //read the field from the user's hash
    const text= await redis.hget(keyFor(userId),field); // null if the field isn't there
    //Redis stores text, so turn it back into an object (or return null if missing)
    return text===null?null: JSON.parse(text);
  } catch (err) {
    // Fail open: a broken cache must never break the request. Treat it as a miss.
    logger.warn({err: err.message, userId,field},"cache read failed");
    return null;
  }
 
}

/** Saves a value for this user + field, and (re)starts the expiry timer. */
export async function setCached(userId, field, value) {
  //if caching is off, do nothing
  if (!redis) return;
  //save the value as text in the user's hash
  //  set the hash to expire after TTL_SECONDS
  //if Redis throws, log a warning and carry on
  try {
    const key= keyFor(userId)
    await redis.hset(key,field,JSON.stringify(value));
    await redis.expire(key, TTL_SECONDS);
   
  } catch (err) {
    logger.warn({err:err.message,userId,field},"cache write failed");
  }
  

}

/** Deletes everything cached for this user. Call after any change to their expenses. */
export async function invalidateUser(userId) {
  if(!redis)return;
  //delete the user's whole hash
  //if Redis throws, log a warning and carry on
  try {
    await redis.del(keyFor(userId));
  } catch (err) {
    logger.warn({err:err.message,userId},"cache invalidation failed");
  }
}
