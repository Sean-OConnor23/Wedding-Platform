import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { NextRequest } from "next/server";
import { getAzureSecrets } from "@/lib/azureConfig";

async function buildAuthOptions(): Promise<NextAuthOptions> {
  const secrets = await getAzureSecrets();

  return {
    secret: secrets["LOGIN-NEXTAUTH-SECRET"],
    providers: [
      GoogleProvider({
        clientId: secrets["LOGIN-GOOGLE-CLIENT-ID"],
        clientSecret: secrets["LOGIN-GOOGLE-SECRET"],
      }),
      FacebookProvider({
        clientId: secrets["LOGIN-FACEBOOK-APP-ID"],
        clientSecret: secrets["LOGIN-FACEBOOK-SECRET"],
      }),
    ],
  };
}

async function handler(req: NextRequest, context: any) {
  const authOptions = await buildAuthOptions();
  return NextAuth(req, context, authOptions);
}

export { handler as GET, handler as POST };

