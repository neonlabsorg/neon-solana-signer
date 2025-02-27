<template>
  <div :class="['form-field', className]">
    <label :class="['form-label', labelClassName]">
      {{ label }}
    </label>
    <select
      v-model="selectedValue"
      @change="handleChange"
      :disabled="disabled"
      :class="['form-select', selectClassName]"
    >
      <option value="" disabled>Select {{ label }}</option>
      <option v-for="(option, index) in options" :key="index" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  labelClassName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string): void;
}>();

const selectedValue = ref<string>(props.value);

const handleChange = () => {
  emit('update:value', selectedValue.value);
};
</script>
