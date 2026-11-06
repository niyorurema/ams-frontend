'use client';

import { useEffect, useRef, type SelectHTMLAttributes } from 'react';

export function NativeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const select = selectRef.current;
    if (!select) return;

    const updateTitle = () => {
      const selectedOption = select.selectedOptions[0];
      const selectedLabel = selectedOption?.textContent?.trim();
      if (selectedLabel) {
        select.title = selectedLabel;
      } else {
        select.removeAttribute('title');
      }
    };

    const observer = new MutationObserver(updateTitle);
    observer.observe(select, { childList: true, subtree: true, characterData: true });
    select.addEventListener('change', updateTitle);
    updateTitle();

    return () => {
      observer.disconnect();
      select.removeEventListener('change', updateTitle);
    };
  }, [props.children, props.defaultValue, props.value]);

  return <select {...props} ref={selectRef} />;
}
