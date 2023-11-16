import { PropsWithChildren } from "react";

export interface PageTemplateProps extends PropsWithChildren {
  //showDownlaodSlide: boolean;
  onDownloadClick: () => void;
}
