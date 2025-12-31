
import React, { useState, useEffect, useMemo } from 'react';

const RichTypewriter = ({ text, speed = 20 }: { text: string, speed?: number }) => {
  const [visibleCount, setVisibleCount] = useState(0);

  // Reset counter when text changes
  useEffect(() => {
    setVisibleCount(0);
  }, [text]);

  // Adjust visibleCount target to be the length of the CLEANED string
  const cleanLength = useMemo(() => text.replace(/\*\*/g, '').length, [text]);

  // Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleCount(prev => {
        if (prev < cleanLength) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, cleanLength]);

  // Parsing and Rendering Logic
  const renderedContent = useMemo(() => {
    // Split by markdown bold syntax: **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    let currentGlobalIndex = 0;
    
    return parts.map((part, index) => {
      const isBold = part.startsWith('**') && part.endsWith('**');
      // Remove asterisks for content if bold
      const content = isBold ? part.slice(2, -2) : part;
      const partLength = content.length;
      
      if (currentGlobalIndex >= visibleCount) {
        return null; // This part hasn't started typing yet
      }

      const charIndexInPart = visibleCount - currentGlobalIndex;
      const textToRender = content.slice(0, Math.min(content.length, charIndexInPart));
      
      currentGlobalIndex += partLength;

      if (textToRender.length === 0) return null;

      if (isBold) {
        return (
          <span key={index} className="text-yellow-400 font-bold drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] animate-pulse-fast">
            {textToRender}
          </span>
        );
      }
      return <span key={index}>{textToRender}</span>;
    });
  }, [text, visibleCount, cleanLength]);

  return <span>{renderedContent}</span>;
};

export default RichTypewriter;
