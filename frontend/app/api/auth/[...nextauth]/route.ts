// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { getAzureSecrets } from "@/lib/azureConfig";
import { NextRequest, NextResponse } from "next/server";

async function auth(req: NextRequest, res: any) {
  try {
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
  } catch (err: any) {
    console.error("NextAuth SSR Crash:", err);
    return NextResponse.json(
      {
        error: err?.message || String(err),
        stack: err?.stack,
        hasEndpoint: Boolean(process.env.AZURE_APPCONFIG_ENDPOINT),
        hasClientId: Boolean(process.env.AZURE_CLIENT_ID),
      },
      { status: 500 }
    );
  }
}

export { auth as GET, auth as POST };
