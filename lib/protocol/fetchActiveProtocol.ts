import { getActiveProtocolRun } from "@/lib/protocol/protocolRuns";

export async function fetchActiveProtocol(userId: string) {
  return getActiveProtocolRun(userId);
}

