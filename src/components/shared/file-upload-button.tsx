"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import * as React from "react";

interface FileUploadButtonProps {
  onFileUpload: (file: File) => void;
  acceptedFileTypes?: string; // e.g., ".xlsx, .xls"
  buttonText?: string;
  icon?: React.ReactNode;
}

export function FileUploadButton({
  onFileUpload,
  acceptedFileTypes = ".xlsx, .xls, .csv",
  buttonText = "Upload File",
  icon = <Upload className="mr-2 h-4 w-4" />,
}: FileUploadButtonProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
      // Reset file input to allow uploading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <Input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={acceptedFileTypes}
        onChange={handleFileChange}
        id="file-upload-input"
      />
      <Button onClick={handleButtonClick} variant="outline">
        {icon}
        {buttonText}
      </Button>
    </>
  );
}
