import { ReactNode } from "react";
import { Navigate } from "react-router";

import {
  canAccessChannel,
  getRoleHomePath,
  type AppChannel,
} from "../auth/session";
import { useSession } from "../auth/SessionContext";

interface ChannelGateProps {
  channel: AppChannel;
  children: ReactNode;
}

export function ChannelGate({ channel, children }: ChannelGateProps) {
  const { user } = useSession();

  if (!canAccessChannel(user.role, channel)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return <>{children}</>;
}

