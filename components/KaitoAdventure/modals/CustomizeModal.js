import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Picker } from 'react-native';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

const CustomizeModal = ({ player, customizeCharacter, toggleModal }) => {
  const [name, setName] = useState(player.name);
  const [avatar, setAvatar] = useState(player.avatar);
  const [trait, setTrait] = useState(player.trait);

  const handleSave = () => {
    customizeCharacter(name, avatar, trait);
    toggleModal('customize');
  };

  return (
    <View style={customizeModalStyles.container}>
      <View style={customizeModalStyles.formGroup}>
        <Text style={customizeModalStyles.label}>Name</Text>
        <TextInput
          style={customizeModalStyles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter name"
          placeholderTextColor={KA_COLORS.textMuted}
        />
      </View>

      <View style={customizeModalStyles.formGroup}>
        <Text style={customizeModalStyles.label}>Avatar</Text>
        <View style={customizeModalStyles.pickerContainer}>
          <Picker
            selectedValue={avatar}
            onValueChange={setAvatar}
            style={customizeModalStyles.picker}
            dropdownIconColor={KA_COLORS.ivory}
          >
            <Picker.Item label="Default" value="default" />
            <Picker.Item label="Warrior" value="warrior" />
            <Picker.Item label="Herbalist" value="herbalist" />
            <Picker.Item label="Explorer" value="explorer" />
          </Picker>
        </View>
      </View>

      <View style={customizeModalStyles.formGroup}>
        <Text style={customizeModalStyles.label}>Trait</Text>
        <View style={customizeModalStyles.pickerContainer}>
          <Picker
            selectedValue={trait}
            onValueChange={setTrait}
            style={customizeModalStyles.picker}
            dropdownIconColor={KA_COLORS.ivory}
          >
            <Picker.Item label="None" value={null} />
            <Picker.Item label="Warrior (+5 Combat Damage)" value="warrior" />
            <Picker.Item label="Craftsman (+10% Craft Success)" value="craftsman" />
          </Picker>
        </View>
      </View>

      <TouchableOpacity style={customizeModalStyles.saveButton} onPress={handleSave}>
        <Text style={customizeModalStyles.saveButtonText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity style={customizeModalStyles.closeButton} onPress={() => toggleModal('customize')}>
        <Text style={customizeModalStyles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const customizeModalStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
    marginBottom: 8,
  },
  input: {
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
    color: KA_COLORS.ivory,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  pickerContainer: {
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
  },
  picker: {
    color: KA_COLORS.ivory,
  },
  saveButton: {
    paddingVertical: 12,
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KA_COLORS.ivory,
  },
  closeButton: {
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
  },
});

export default CustomizeModal;
