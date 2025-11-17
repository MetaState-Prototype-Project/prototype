import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters?: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  return (
    <Button 
      onClick={() => alert('Upload functionality requires backend database')} 
      className={buttonClassName} 
      type="button"
    >
      {children}
    </Button>
  );
}
