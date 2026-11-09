import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { currentRole } from "@/lib/access";
import { decideRequest, requestDecisionSchema } from "@/lib/circulation";
import { circulationFailure, readJson, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if ((await currentRole()) !== "admin") {
    return signInRequired();
  }

  const { id } = await context.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId < 1) {
    return NextResponse.json({ message: "Book request not found." }, { status: 404 });
  }

  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const parsed = requestDecisionSchema.safeParse(json.body);
  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    return NextResponse.json(
      { message: flattened.formErrors[0] ?? "The book request is not valid." },
      { status: 400 },
    );
  }

  try {
    await decideRequest(requestId, parsed.data.status);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}
