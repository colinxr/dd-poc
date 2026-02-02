import { Session } from "@shopify/shopify-api";
import { SessionStorage } from "@shopify/shopify-app-session-storage";
import { PrismaClient, Prisma } from "@prisma/client";
import prisma from "./db.server";

export class WorkerSessionStorage implements SessionStorage {
  constructor(private prismaClient: PrismaClient = prisma) {}

  async storeSession(session: Session): Promise<boolean> {
    const data = this.sessionToRow(session);

    try {
      await this.prismaClient.session.upsert({
        where: { id: session.id },
        update: data,
        create: data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        await this.prismaClient.session.upsert({
          where: { id: session.id },
          update: data,
          create: data,
        });
        return true;
      }
      throw error;
    }
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    console.log("WorkerSessionStorage: loadSession called with id:", id);
    const row = await this.prismaClient.session.findUnique({
      where: { id },
    });

    console.log("WorkerSessionStorage: loadSession result:", row ? "found" : "not found");

    if (!row) {
      return undefined;
    }

    return this.rowToSession(row);
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await this.prismaClient.session.delete({
        where: { id },
      });
    } catch {
      return true;
    }
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await this.prismaClient.session.deleteMany({
      where: { id: { in: ids } },
    });
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    console.log("WorkerSessionStorage: findSessionsByShop called with shop:", shop);
    const sessions = await this.prismaClient.session.findMany({
      where: { shop },
      take: 25,
      orderBy: { expires: "desc" },
    });
    
    console.log("WorkerSessionStorage: findSessionsByShop result count:", sessions.length);

    return sessions.map((session) => this.rowToSession(session));
  }

  private sessionToRow(session: Session): any {
    const sessionParams = session.toObject();
    return {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope || null,
      expires: session.expires || null,
      accessToken: session.accessToken || "",
      userId: sessionParams.onlineAccessInfo?.associated_user.id
        ? BigInt(sessionParams.onlineAccessInfo.associated_user.id)
        : null,
      firstName:
        sessionParams.onlineAccessInfo?.associated_user.first_name || null,
      lastName:
        sessionParams.onlineAccessInfo?.associated_user.last_name || null,
      email: sessionParams.onlineAccessInfo?.associated_user.email || null,
      accountOwner:
        sessionParams.onlineAccessInfo?.associated_user.account_owner || false,
      locale: sessionParams.onlineAccessInfo?.associated_user.locale || null,
      collaborator:
        sessionParams.onlineAccessInfo?.associated_user.collaborator || false,
      emailVerified:
        sessionParams.onlineAccessInfo?.associated_user.email_verified || false,
      refreshToken: sessionParams.refreshToken || null,
      refreshTokenExpires: sessionParams.refreshTokenExpires || null,
    };
  }

  private rowToSession(row: any): Session {
    const sessionParams: any = {
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.isOnline,
    };

    if (row.userId) sessionParams.userId = String(row.userId);
    if (row.firstName) sessionParams.firstName = String(row.firstName);
    if (row.lastName) sessionParams.lastName = String(row.lastName);
    if (row.email) sessionParams.email = String(row.email);
    if (row.locale) sessionParams.locale = String(row.locale);
    if (row.accountOwner !== null)
      sessionParams.accountOwner = row.accountOwner;
    if (row.collaborator !== null)
      sessionParams.collaborator = row.collaborator;
    if (row.emailVerified !== null)
      sessionParams.emailVerified = row.emailVerified;
    if (row.expires) sessionParams.expires = row.expires.getTime();
    if (row.scope) sessionParams.scope = row.scope;
    if (row.accessToken) sessionParams.accessToken = row.accessToken;
    if (row.refreshToken) sessionParams.refreshToken = row.refreshToken;
    if (row.refreshTokenExpires)
      sessionParams.refreshTokenExpires = row.refreshTokenExpires.getTime();

    return Session.fromPropertyArray(Object.entries(sessionParams), true);
  }
}
