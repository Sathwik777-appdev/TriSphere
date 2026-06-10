package com.trisphere.app;

import android.Manifest;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "AppPermissions",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        ),
        @Permission(
            alias = "microphone",
            strings = { Manifest.permission.RECORD_AUDIO }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        ),
        @Permission(
            alias = "files",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        ),
        @Permission(
            alias = "files_tiramisu",
            strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO }
        )
    }
)
public class AppPermissionsPlugin extends Plugin {

    @PluginMethod
    public void exitApp(PluginCall call) {
        getActivity().finishAffinity();
        System.exit(0);
        call.resolve();
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("camera", getPermissionState("camera") == PermissionState.GRANTED);
        ret.put("microphone", getPermissionState("microphone") == PermissionState.GRANTED);
        
        // Notifications don't require runtime permission on SDK < 33
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ret.put("notifications", getPermissionState("notifications") == PermissionState.GRANTED);
        } else {
            ret.put("notifications", true);
        }

        // Check file permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionState state = getPermissionState("files_tiramisu");
            ret.put("files", state == PermissionState.GRANTED || "LIMITED".equals(state.toString()));
        } else {
            ret.put("files", getPermissionState("files") == PermissionState.GRANTED);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String type = call.getString("type");
        
        if ("notifications".equals(type) && Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        if ("files".equals(type) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("files_tiramisu", call, "permissionCallback");
            return;
        }

        requestPermissionForAlias(type, call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        String type = call.getString("type");
        boolean granted;
        if ("files".equals(type) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            PermissionState state = getPermissionState("files_tiramisu");
            granted = (state == PermissionState.GRANTED || "LIMITED".equals(state.toString()));
        } else {
            PermissionState state = getPermissionState(type);
            granted = (state == PermissionState.GRANTED || "LIMITED".equals(state.toString()));
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }
}
