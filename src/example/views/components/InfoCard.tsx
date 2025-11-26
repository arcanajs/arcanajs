import React from "react";

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

export const InfoCard: React.FC<InfoCardProps> = ({ title, children }) => {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        margin: "10px 0",
        backgroundColor: "#f9f9f9",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div>{children}</div>
    </div>
  );
};
