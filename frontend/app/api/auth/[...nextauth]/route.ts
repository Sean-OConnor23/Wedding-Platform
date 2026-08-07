// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { getAzureSecrets } from "@/lib/azureConfig";
import { NextRequest } from "next/server";

async function auth(req: NextRequest, res: any) {
  const azure = await getAzureSecrets();

  return await NextAuth(req, res, {
    providers: [
      GoogleProvider({
        clientId: azure["LOGIN-GOOGLE-CLIENT-ID"],
        clientSecret: azure["LOGIN-GOOGLE-SECRET"],
      }),
      FacebookProvider({
        clientId: azure["LOGIN-FACEBOOK-APP-ID"],
        clientSecret: azure["LOGIN-FACEBOOK-SECRET"],
      }),
    ],
    secret: azure["LOGIN-NEXTAUTH-SECRET"],
  });
}

export { auth as GET, auth as POST };
