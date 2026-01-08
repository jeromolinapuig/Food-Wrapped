let modalLockCount = 0;

export const lockBodyScroll = () => {
  modalLockCount += 1;
  if (modalLockCount === 1) {
    document.body.classList.add('bw-modal-open');
  }

  return () => {
    modalLockCount = Math.max(0, modalLockCount - 1);
    if (modalLockCount === 0) {
      document.body.classList.remove('bw-modal-open');
    }
  };
};
