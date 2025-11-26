import React from "react";
import { Body, Head, Page } from "../../../../../lib";

interface AuditLogProps {
  logs: string[];
}

const AuditLog: React.FC<AuditLogProps> = ({ logs }) => {
  return (
    <Page title="Security Audit Log">
      <Head>
        <meta
          name="description"
          content="Detailed security audit logs for administrative review."
        />
      </Head>
      <Body>
        <h1>Security Audit Log</h1>
        <p>
          This page is deeply nested: views/admin/settings/security/AuditLog.tsx
        </p>
        <ul>
          {logs.map((log, i) => (
            <li key={i}>{log}</li>
          ))}
        </ul>
      </Body>
    </Page>
  );
};

export default AuditLog;
