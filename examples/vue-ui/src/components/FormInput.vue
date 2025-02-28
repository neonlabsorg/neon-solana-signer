<template>
  <div :class="className">
    <label :class="['form-label flex flex-row justify-between', labelClassName]">
      <span>{{ label }}</span>
      <span v-if="rightLabel">
        <span v-if="typeof rightLabel === 'function'">{{ rightLabel() }}</span>
        <span v-else>{{ rightLabel }}</span>
      </span>
    </label>

    <input
      :type="type"
      :value="value"
      @input="handleInput"
      :disabled="disabled"
      :placeholder="placeholder"
      :class="['form-input', inputClassName]"
    />
  </div>
</template>

<script setup lang="ts">

const props = defineProps<{
  label: string;
  value: string;
  onChange?: (event: Event) => void;
  onInput?: (event: Event) => void;
  disabled?: boolean;
  placeholder?: string;
  rightLabel?: string | (() => string);
  type?: 'text' | 'number' | 'email' | 'password';
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:value', value: string): void;
}>();

const handleInput = (event: Event) => {
  const inputElement = event.target as HTMLInputElement;
  if (props.onInput) {
    props.onInput(event);
  }

  emit('update:value', inputElement.value);
};
</script>

