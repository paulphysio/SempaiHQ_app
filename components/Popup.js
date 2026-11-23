import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GelModal, GelInput } from './gel/GelKit';

const Popup = ({ visible, onClose, onSubmit }) => {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    onSubmit(text);
    setText('');
  };

  return (
    <GelModal
      visible={visible}
      onClose={onClose}
      icon="feather-alt"
      title="Why do you want to apply?"
      subtitle="Tell us what you create and what drives you."
      actions={[
        { label: 'Cancel', variant: 'secondary', onPress: onClose },
        { label: 'Send', icon: 'paper-plane', onPress: handleSubmit, disabled: !text.trim() },
      ]}
    >
      <GelInput multiline value={text} onChangeText={setText} placeholder="Your passion and experience…" />
    </GelModal>
  );
};

export const getPopupStyles = (c) => StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  modalTitle: {
    fontSize: 20,
    
    color: c.textPrimary,
    marginBottom: 15,
  },
  input: {
    width: '100%',
    backgroundColor: '#2c2c2c',
    color: c.textPrimary,
    borderRadius: 10,
    padding: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
  },
  buttonClose: {
    backgroundColor: '#555',
  },
  buttonSubmit: {
    backgroundColor: c.accent,
  },
  textStyle: {
    color: 'white',
    
    textAlign: 'center',
  },
});

export default Popup;
