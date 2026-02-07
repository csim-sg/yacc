import express from 'express';

/**
 * JSON body parsing middleware
 * 
 * Parses incoming JSON request bodies.
 * Must be registered in routing-controllers middlewares array.
 * 
 * @returns Express middleware function for JSON body parsing
 */
export const bodyParserMiddleware = express.json();
