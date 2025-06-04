// src/lib/auth.ts
import * as jose from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET_STRING = process.env.JWT_SECRET;

if (!JWT_SECRET_STRING) {
    throw new Error('Missing JWT_SECRET environment variable. Please set it in your .env file.');
}

// Encode the string secret into a Uint8Array for jose, done once at module load
const JWT_SECRET_UINT8ARRAY = new TextEncoder().encode(JWT_SECRET_STRING);

// Your existing verifyPassword (no changes needed for this specific issue)
export async function verifyPassword(password: string, hashedPassword?: string | null): Promise<boolean> {
    if (!hashedPassword) return false;
    return await bcrypt.compare(password, hashedPassword);
}

// Your existing hashPassword (no changes needed for this specific issue)
export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// Define the expected payload structure, extending jose.JWTPayload for standard claims
export interface AuthTokenPayload extends jose.JWTPayload {
    userId: string; // Ensure userId is consistently a string in the token
    // You could include role here for minor optimization, but fetching in middleware is more secure for role changes
    // role?: string;
}

/**
 * Generates a JWT token.
 * @param userId - The user's ID (number or string). Will be converted to string.
 * @returns A promise that resolves to the JWT token string.
 */
export async function generateToken(userId: number | string): Promise<string> {
    const userIdString = userId.toString(); // Consistent string representation

    const token = await new jose.SignJWT({ userId: userIdString }) // Custom claims
        .setProtectedHeader({ alg: 'HS256' }) // Algorithm for signing
        .setIssuedAt() // Sets 'iat' (issued at) claim
        .setSubject(userIdString) // Sets 'sub' (subject) claim, standard practice for user ID
        .setExpirationTime('7d') // Sets 'exp' (expiration time) claim
        // .setJti() // Optional: sets 'jti' (JWT ID) for a unique token identifier
        // .setIssuer('your-app-name') // Optional: sets 'iss' (issuer) claim
        // .setAudience('your-app-audience') // Optional: sets 'aud' (audience) claim
        .sign(JWT_SECRET_UINT8ARRAY);

    return token;
}

/**
 * Verifies a JWT token.
 * @param token - The JWT token string to verify.
 * @returns A promise that resolves to the AuthTokenPayload if valid, or null otherwise.
 */
export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
    if (!token) {
        return null;
    }
    try {
        const { payload } = await jose.jwtVerify<AuthTokenPayload>(
            token,
            JWT_SECRET_UINT8ARRAY,
            {
                algorithms: ['HS256'], // Specify the expected algorithm(s)
                // issuer: 'your-app-name', // If you set issuer during generation
                // audience: 'your-app-audience', // If you set audience during generation
            }
        );
        // The payload is already typed as AuthTokenPayload due to the generic.
        return payload;
    } catch (error: any) {
        // Log the error for debugging on the server.
        // Avoid logging the token itself in production logs unless necessary and secured.
        if (error.code === 'ERR_JWT_EXPIRED') {
            console.error('Token verification failed: Token has expired.');
        } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
            console.error('Token verification failed: Signature verification failed.');
        } else {
            console.error('Invalid token:', error.message || error.code || 'Unknown token verification error');
        }
        return null;
    }
}