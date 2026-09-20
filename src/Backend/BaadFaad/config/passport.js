import 'dotenv/config';
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findOrCreateOAuthUser } from "../repositories/user.repository.js";
import { generateToken } from "../utils/generateToken.js";

let isPassportConfigured = false;

/**
 * Configure passport with Google OAuth strategy
 * This is called lazily to ensure env vars are loaded
 */
const configurePassport = () => {
  if (isPassportConfigured) {
    return passport;
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not defined in environment variables');
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET is not defined in environment variables');
  }
  const callbackURL = (process.env.GOOGLE_CALLBACK_URL || 'https://classathon-hisabsathi-baadfaad.onrender.com/api/auth/google/callback').replace(/\/$/, '');
  console.log(`Configuring Google OAuth callback URL: ${callbackURL}`);

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('Google profile did not provide an email address'), null);
          const user = await findOrCreateOAuthUser({
            name: profile.displayName || email.split('@')[0],
            email,
            image: profile.photos?.[0]?.value,
          });

          const token = generateToken(user);

          done(null, { token, user: { id: user._id, _id: user._id, name: user.name, email: user.email, image: user.image } });
        } catch (error) {
          done(error, null);
        }
      }
    )
  );

  isPassportConfigured = true;
  return passport;
};

/**
 * Get configured passport instance
 * @returns {passport} Configured passport instance
 */
export const getPassport = () => {
  return configurePassport();
};
