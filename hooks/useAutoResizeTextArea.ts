import { useEffect } from 'react';

export const useAutoResizeTextArea = (
  textAreaRef: HTMLTextAreaElement | null,
  value: string
) => {
  useEffect(() => {
    if (textAreaRef) {
      // We need to reset the height momentarily to get the correct scrollHeight for shorter text
      textAreaRef.style.height = 'auto';
      const scrollHeight = textAreaRef.scrollHeight;
      
      // We then set the height directly
      textAreaRef.style.height = scrollHeight + 'px';
    }
  }, [textAreaRef, value]);
};