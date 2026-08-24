#include <napi.h>
#include <windows.h>
#include <tlhelp32.h>
#include <winternl.h>
#include <string>
#include <vector>

constexpr PROCESSINFOCLASS kProcessCommandLineInformation = static_cast<PROCESSINFOCLASS>(60);
constexpr NTSTATUS kStatusBufferOverflow = static_cast<NTSTATUS>(0x80000005L);
constexpr NTSTATUS kStatusInfoLengthMismatch = static_cast<NTSTATUS>(0xC0000004L);
constexpr NTSTATUS kStatusBufferTooSmall = static_cast<NTSTATUS>(0xC0000023L);

Napi::Array GetPidsByName(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "processName must be a string").ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  std::u16string requested = info[0].As<Napi::String>().Utf16Value();
  std::wstring processName(reinterpret_cast<const wchar_t*>(requested.data()), requested.size());
  std::vector<DWORD> pids;
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) return Napi::Array::New(env);

  PROCESSENTRY32W entry{};
  entry.dwSize = sizeof(entry);
  if (Process32FirstW(snapshot, &entry)) {
    do {
      if (_wcsicmp(entry.szExeFile, processName.c_str()) == 0) pids.push_back(entry.th32ProcessID);
    } while (Process32NextW(snapshot, &entry));
  }
  CloseHandle(snapshot);

  Napi::Array result = Napi::Array::New(env, pids.size());
  for (size_t i = 0; i < pids.size(); ++i) result.Set(i, Napi::Number::New(env, pids[i]));
  return result;
}

Napi::String GetProcessCommandLine(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "pid must be a number").ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  DWORD pid = info[0].As<Napi::Number>().Uint32Value();
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (!process) {
    Napi::Error::New(env, "OpenProcess failed: " + std::to_string(GetLastError())).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  ULONG size = 0;
  NTSTATUS status = NtQueryInformationProcess(process, kProcessCommandLineInformation, nullptr, 0, &size);
  if (status != kStatusBufferOverflow && status != kStatusBufferTooSmall && status != kStatusInfoLengthMismatch) {
    CloseHandle(process);
    Napi::Error::New(env, "NtQueryInformationProcess size query failed").ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  std::vector<unsigned char> buffer(size);
  status = NtQueryInformationProcess(process, kProcessCommandLineInformation, buffer.data(), size, &size);
  CloseHandle(process);
  if (!NT_SUCCESS(status)) {
    Napi::Error::New(env, "NtQueryInformationProcess failed").ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  auto commandLine = reinterpret_cast<PUNICODE_STRING>(buffer.data());
  if (!commandLine->Buffer || commandLine->Length == 0) return Napi::String::New(env, "");
  std::u16string value(reinterpret_cast<const char16_t*>(commandLine->Buffer), commandLine->Length / sizeof(WCHAR));
  return Napi::String::New(env, value);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("getPidsByName", Napi::Function::New(env, GetPidsByName));
  exports.Set("getProcessCommandLine", Napi::Function::New(env, GetProcessCommandLine));
  return exports;
}

NODE_API_MODULE(lcu_native, Init)
