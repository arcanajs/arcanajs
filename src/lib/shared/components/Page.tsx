import React from "react";
import { PageContext } from "../context/PageContext";
import { Head } from "./Head";

export const Page = <T,>({
  data,
  title,
  children,
}: {
  data?: T;
  title?: string;
  children: React.ReactNode;
}) => {
  return (
    <PageContext.Provider value={data as unknown}>
      {title && (
        <Head>
          <title>{title}</title>
        </Head>
      )}
      {children}
    </PageContext.Provider>
  );
};
