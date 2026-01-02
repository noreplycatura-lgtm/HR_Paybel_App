"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import * as React from "react";

interface FileUploadButtonProps {
  onFileUpload: (file: File) => void;
  acceptedFileTypes?: string;
  buttonText?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
  title?: string;
}

export function FileUploadButton({
  onFileUpload,
  acceptedFileTypes = ".xlsx, .xls, .csv",
  buttonText = "Upload File",
  icon = <Upload className="mr-2 h-4 w-4" />,
  disabled = false,
  variant = "outline",
  className = "",
  title,
}: FileUploadButtonProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleButtonClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
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
        disabled={disabled}
      />
      <Button 
        onClick={handleButtonClick} 
        variant={variant}
        disabled={disabled}
        className={className}
        title={title}
      >
        {icon}
        {buttonText}
      </Button>
    </>
  );
}