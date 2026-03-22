import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMMANDS } from '../constants/commands';

/**
 * Command palette state management + keyboard shortcut handling.
 * Ctrl+K (or Cmd+K on Mac) toggles the palette.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  }, []);

  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.shortcut?.toLowerCase().includes(query.toLowerCase())
  );

  const executeCommand = useCallback(
    (command) => {
      if (command.action) {
        command.action();
      } else if (command.path) {
        navigate(command.path);
      }
      close();
    },
    [navigate, close]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, close]);

  return {
    isOpen,
    query,
    setQuery,
    filteredCommands,
    executeCommand,
    open,
    close,
    toggle,
  };
}
