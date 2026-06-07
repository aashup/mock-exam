<?php

namespace App\Http\Controllers;

use App\Services\RestoreService;
use Illuminate\Http\Request;

class RestoreController extends Controller
{
    public function __construct(private RestoreService $restore)
    {
    }

    /**
     * GET /api/restore — full account dataset for a fresh-device login.
     */
    public function index(Request $request)
    {
        return response()->json($this->restore->fullDataset($request->user()));
    }
}
